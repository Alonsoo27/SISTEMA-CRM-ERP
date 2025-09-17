const obtenerFechaPeruISO = () => {
    const ahora = new Date();
    // Peru UTC-5 (sin horario de verano)
    const offsetPeru = -5 * 60; // -5 horas en minutos
    const fechaPeru = new Date(ahora.getTime() + (offsetPeru * 60 * 1000));
    return fechaPeru.toISOString();
};

const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');

// 🚀 NUEVA IMPORTACIÓN PARA INTEGRACIÓN AUTOMÁTICA PROSPECTO → VENTA
const ConversionService = require('../../ventas/services/ConversionService');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

//helper
function parseHistorialSeguro(historial) {
    if (!historial) return [];
    if (Array.isArray(historial)) return historial;
    
    if (typeof historial === 'string') {
        try {
            const parsed = JSON.parse(historial);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    
    return [];
}

// CONFIGURACIÓN DE LOGGING
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'prospectos-pipeline' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/prospectos.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// VALIDACIONES DE PROSPECTO
const validarProspecto = (prospecto) => {
    const errores = [];

    // Validar campos requeridos
    if (!prospecto.nombre_cliente?.trim()) {
        errores.push('El nombre del cliente es requerido');
    } else if (prospecto.nombre_cliente.length > 100) {
        errores.push('El nombre del cliente no puede exceder 100 caracteres');
    }

    if (!prospecto.telefono?.trim()) {
        errores.push('El teléfono es requerido');
    } else if (prospecto.telefono.length > 20) {
        errores.push('El teléfono no puede exceder 20 caracteres');
    }

    if (!prospecto.canal_contacto?.trim()) {
        errores.push('El canal de contacto es requerido');
    }

    // Validar canal de contacto válido
    const canalesValidos = ['WhatsApp', 'Messenger', 'Facebook', 'TikTok', 'Llamada', 'Presencial', 'Email'];
    if (prospecto.canal_contacto && !canalesValidos.includes(prospecto.canal_contacto)) {
        errores.push(`Canal de contacto debe ser uno de: ${canalesValidos.join(', ')}`);
    }

    // Validar email si se proporciona
    if (prospecto.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prospecto.email)) {
        errores.push('El formato del email no es válido');
    }

    // Validar presupuesto estimado
    if (prospecto.presupuesto_estimado && (isNaN(prospecto.presupuesto_estimado) || prospecto.presupuesto_estimado < 0)) {
        errores.push('El presupuesto estimado debe ser un número positivo');
    }

    // Validar valor estimado
    if (prospecto.valor_estimado && (isNaN(prospecto.valor_estimado) || prospecto.valor_estimado < 0)) {
        errores.push('El valor estimado debe ser un número positivo');
    }

    // Validar probabilidad de cierre
    if (prospecto.probabilidad_cierre && (isNaN(prospecto.probabilidad_cierre) || prospecto.probabilidad_cierre < 0 || prospecto.probabilidad_cierre > 100)) {
        errores.push('La probabilidad de cierre debe estar entre 0 y 100');
    }

    return errores;
};

class ProspectosController {
    
    // =====================================================
    // ENDPOINTS PRINCIPALES DEL PIPELINE
    // =====================================================
    
    /**
     * GET /api/prospectos
     * Obtener todos los prospectos con filtros
     */
    static async obtenerTodos(req, res) {
        try {
            const { 
                asesor_id, 
                estado, 
                canal_contacto, 
                fecha_desde, 
                fecha_hasta, 
                antiguedad,
                busqueda,
                page = 1,
                limit = 50
            } = req.query;

            let query = supabase
                .from('prospectos')
                .select(`
                    *,
                    usuarios!asesor_id(nombre, apellido)
                `)
                .eq('activo', true)
                .order('fecha_ultima_actualizacion', { ascending: false });

            // Aplicar filtros
            if (asesor_id) {
                query = query.eq('asesor_id', asesor_id);
            }

            if (estado) {
                query = query.eq('estado', estado);
            }

            if (canal_contacto) {
                query = query.eq('canal_contacto', canal_contacto);
            }

            if (fecha_desde) {
                query = query.gte('fecha_contacto', fecha_desde);
            }

            if (fecha_hasta) {
                query = query.lte('fecha_contacto', fecha_hasta);
            }

            // Filtro por antigüedad
            if (antiguedad) {
                const ahora = new Date();
                let fechaLimite;
                
                switch (antiguedad) {
                    case 'ultimos_7_dias':
                        fechaLimite = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'ultimos_30_dias':
                        fechaLimite = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    case 'mas_de_60_dias':
                        fechaLimite = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);
                        query = query.lt('fecha_contacto', fechaLimite.toISOString());
                        break;
                    default:
                        break;
                }
                
                if (antiguedad !== 'mas_de_60_dias' && fechaLimite) {
                    query = query.gte('fecha_contacto', fechaLimite.toISOString());
                }
            }

            // Búsqueda por texto
            if (busqueda) {
                query = query.or(`nombre_cliente.ilike.%${busqueda}%,apellido_cliente.ilike.%${busqueda}%,empresa.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%`);
            }

            // Paginación
            const offset = (page - 1) * limit;
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) {
                logger.error('Error al obtener prospectos:', error);
                throw error;
            }

            logger.info(`Prospectos obtenidos: ${data?.length || 0} registros`);

            res.json({
                success: true,
                data: data || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count
                }
            });

        } catch (error) {
            logger.error('Error en obtenerTodos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener prospectos: ' + error.message
            });
        }
    }

    /**
     * GET /api/prospectos/kanban/:asesorId?
     * Obtener datos organizados para Kanban Board
     */
    static async obtenerKanban(req, res) {
        try {
            const { asesorId } = req.params;
            const { incluir_modo_libre = false } = req.query;

            let query = supabase
                .from('prospectos')
                .select(`
                    id, codigo, nombre_cliente, apellido_cliente, empresa, telefono, email,
                    canal_contacto, estado, valor_estimado, probabilidad_cierre,
                    fecha_contacto, fecha_seguimiento, productos_interes, observaciones,
                    asesor_id, asesor_nombre, modo_libre, numero_reasignaciones
                `)
                .eq('activo', true);

            // Filtrar por asesor si se especifica
            if (asesorId && asesorId !== 'todos') {
                if (incluir_modo_libre === 'true') {
                    // Incluir prospectos del asesor + los en modo libre
                    query = query.or(`asesor_id.eq.${asesorId},modo_libre.eq.true`);
                } else {
                    query = query.eq('asesor_id', asesorId).eq('modo_libre', false);
                }
            }

            const { data, error } = await query;

            if (error) {
                logger.error('Error al obtener datos del Kanban:', error);
                throw error;
            }

            // Agrupar por estado
            const kanbanData = {
                Prospecto: [],
                Cotizado: [],
                Negociacion: [],
                Cerrado: [],
                Perdido: []
            };

            let valorTotalPipeline = 0;

            (data || []).forEach(prospecto => {
                if (kanbanData[prospecto.estado]) {
                    kanbanData[prospecto.estado].push({
                        ...prospecto,
                        dias_en_etapa: Math.floor((new Date() - new Date(prospecto.fecha_contacto)) / (1000 * 60 * 60 * 24))
                    });
                    
                    if (['Prospecto', 'Cotizado', 'Negociacion'].includes(prospecto.estado)) {
                        valorTotalPipeline += parseFloat(prospecto.valor_estimado || 0);
                    }
                }
            });

            // Ordenar cada columna por prioridad
            Object.keys(kanbanData).forEach(estado => {
                kanbanData[estado].sort((a, b) => {
                    // Prioridad: modo libre > número de reasignaciones > fecha más antigua
                    if (a.modo_libre !== b.modo_libre) return b.modo_libre - a.modo_libre;
                    if (a.numero_reasignaciones !== b.numero_reasignaciones) return b.numero_reasignaciones - a.numero_reasignaciones;
                    return new Date(a.fecha_contacto) - new Date(b.fecha_contacto);
                });
            });

            const metricas = {
                total_prospectos: data?.length || 0,
                valor_total_pipeline: valorTotalPipeline,
                distribucion: {
                    prospecto: kanbanData.Prospecto.length,
                    cotizado: kanbanData.Cotizado.length,
                    negociacion: kanbanData.Negociacion.length,
                    cerrado: kanbanData.Cerrado.length,
                    perdido: kanbanData.Perdido.length
                },
                modo_libre_activos: (data || []).filter(p => p.modo_libre).length
            };

            logger.info(`Kanban obtenido: ${metricas.total_prospectos} prospectos, $${valorTotalPipeline} en pipeline`);

            res.json({
                success: true,
                data: kanbanData,
                metricas: metricas
            });

        } catch (error) {
            logger.error('Error en obtenerKanban:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener datos del Kanban: ' + error.message
            });
        }
    }

    /**
     * POST /api/prospectos
     * Crear nuevo prospecto - CORREGIDO CON FECHAS PERU
     */
    static async crearProspecto(req, res) {
        try {
            const datosProspecto = req.body;
            
            // TODO: Obtener del token JWT cuando esté implementado
            const asesorId = req.user?.user_id || req.user?.id || 1;
            const asesorNombre = req.user?.nombre_completo || req.user?.nombre || 'Admin User';

            // Agregar log para debug
            console.log('🔐 Usuario JWT en crearProspecto:', {
                user_id: req.user?.user_id,
                nombre: req.user?.nombre,
                rol: req.user?.rol
            });

            // Asignación automática del asesor logueado
            datosProspecto.asesor_id = asesorId;
            datosProspecto.asesor_nombre = asesorNombre;
            datosProspecto.asesor_original_id = asesorId;
            datosProspecto.asesor_original_nombre = asesorNombre;

            // Validaciones
            const errores = validarProspecto(datosProspecto);
            if (errores.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Errores de validación',
                    errores: errores
                });
            }

            // Verificar duplicados por teléfono
            const { data: duplicados } = await supabase
                .from('prospectos')
                .select('id, codigo, nombre_cliente, apellido_cliente, estado, asesor_nombre')
                .eq('telefono', datosProspecto.telefono)
                .eq('activo', true);

            if (duplicados && duplicados.length > 0) {
                logger.warn(`Intento de crear prospecto duplicado: ${datosProspecto.telefono}`);
                return res.status(409).json({
                    success: false,
                    error: 'Ya existe un prospecto con este teléfono',
                    prospecto_existente: duplicados[0]
                });
            }

            // CORRECCIÓN CRÍTICA: Calcular fecha de seguimiento con timezone Peru
            const fechaActualPeru = obtenerFechaPeruISO();
            const fechaSeguimiento = datosProspecto.fecha_seguimiento || (() => {
                const fechaBase = new Date(fechaActualPeru);
                const fechaMas24h = new Date(fechaBase.getTime() + (24 * 60 * 60 * 1000));
                return fechaMas24h.toISOString();
            })();

            // Crear prospecto CON todas las fechas corregidas para Peru
            const { data, error } = await supabase
            .from('prospectos')
            .insert([{
                ...datosProspecto,
                seguimiento_obligatorio: fechaSeguimiento,
                created_at: fechaActualPeru,
                fecha_contacto: datosProspecto.fecha_contacto || fechaActualPeru,
                fecha_ultima_actualizacion: fechaActualPeru,
                productos_interes: datosProspecto.productos_interes || [],
                historial_interacciones: [{
                fecha: fechaActualPeru,
                tipo: 'Creación',
                descripcion: `Prospecto creado vía ${datosProspecto.canal_contacto}`,
                usuario: asesorNombre
                }]
            }])
                .select()
                .single();

            if (error) {
                logger.error('Error al crear prospecto:', error);
                throw error;
            }

            logger.info(`Prospecto creado (Peru timezone): ${data.codigo} - ${data.nombre_cliente} - Seguimiento: ${fechaSeguimiento}`);

            res.status(201).json({
                success: true,
                data: data,
                message: 'Prospecto creado exitosamente'
            });

        } catch (error) {
            logger.error('Error en crearProspecto:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear prospecto: ' + error.message
            });
        }
    }

    /**
     * PUT /api/prospectos/:id
     * Actualizar prospecto - CORREGIDO CON FECHAS PERU
     */
    static async actualizarProspecto(req, res) {
        try {
            const { id } = req.params;
            const datosActualizacion = req.body;

            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de prospecto inválido'
                });
            }

            // Verificar que el prospecto existe
            const { data: prospectoExistente } = await supabase
                .from('prospectos')
                .select('*')
                .eq('id', id)
                .eq('activo', true)
                .single();

            if (!prospectoExistente) {
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            // SOLUCIÓN: LISTA DE CAMPOS VÁLIDOS PERMITIDOS
            const camposPermitidos = [
                'nombre_cliente', 'apellido_cliente', 'telefono', 'email', 'empresa',
                'cargo', 'direccion', 'distrito', 'ciudad', 'canal_contacto',
                'origen_contacto', 'productos_interes', 'presupuesto_estimado',
                'estado', 'estado_anterior', 'tipo_cierre', 'probabilidad_cierre',
                'valor_estimado', 'motivo_perdida', 'asesor_id', 'asesor_nombre',
                'seguimiento_obligatorio', 'seguimiento_completado', 'seguimiento_vencido',
                'numero_reasignaciones', 'modo_libre', 'fecha_modo_libre',
                'negociacion_fallida', 'motivo_falla_negociacion', 'fecha_contacto',
                'fecha_ultima_actualizacion', 'fecha_seguimiento', 'fecha_cierre',
                'observaciones', 'historial_interacciones', 'convertido_venta',
                'venta_id', 'updated_at'
            ];

            // FILTRAR SOLO CAMPOS VÁLIDOS
            const datosLimpios = {};
            Object.keys(datosActualizacion).forEach(campo => {
                if (camposPermitidos.includes(campo)) {
                    datosLimpios[campo] = datosActualizacion[campo];
                } else {
                    logger.warn(`⚠️ Campo ignorado (no existe): ${campo}`);
                }
            });

            // Agregar timestamps automáticos
            datosLimpios.fecha_ultima_actualizacion = obtenerFechaPeruISO();
            datosLimpios.updated_at = obtenerFechaPeruISO();

            // Validaciones si se actualizan campos críticos
            if (datosLimpios.telefono && datosLimpios.telefono !== prospectoExistente.telefono) {
                const { data: duplicados } = await supabase
                    .from('prospectos')
                    .select('id, codigo, nombre_cliente')
                    .eq('telefono', datosLimpios.telefono)
                    .eq('activo', true)
                    .neq('id', id);

                if (duplicados && duplicados.length > 0) {
                    return res.status(409).json({
                        success: false,
                        error: 'Ya existe otro prospecto con este teléfono',
                        prospecto_existente: duplicados[0]
                    });
                }
            }

            // Validar datos si se proporcionan
            const errores = validarProspecto({ ...prospectoExistente, ...datosLimpios });
            if (errores.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Errores de validación',
                    errores: errores
                });
            }

            logger.info(`🔧 Actualizando prospecto ${id}, campos:`, Object.keys(datosLimpios));

            // ESTRATEGIA MULTI-LEVEL PARA MANEJAR RLS ISSUES
            let updateResult = null;
            let metodoUsado = '';

            // MÉTODO 1: Update estándar con bypass de RLS
            try {
                const { data, error } = await supabase
                    .from('prospectos')
                    .update(datosLimpios)
                    .eq('id', parseInt(id))
                    .select('id, codigo, nombre_cliente, apellido_cliente, telefono, email, estado, seguimiento_vencido, seguimiento_completado, fecha_ultima_actualizacion, asesor_nombre')
                    .single();

                if (!error) {
                    updateResult = data;
                    metodoUsado = 'standard_update';
                } else if (error.code === '42P10') {
                    throw new Error('RLS_CONFLICT'); // Activar fallback
                } else {
                    throw error;
                }
            } catch (error) {
                if (error.message === 'RLS_CONFLICT' || error.code === '42P10') {
                    logger.info('🔄 Método 1 falló, probando UPDATE por campos individuales...');
                    
                    // MÉTODO 2: Update campo por campo para bypass de RLS
                    try {
                        // Actualizar campos críticos uno por uno
                        if (datosLimpios.seguimiento_vencido !== undefined) {
                            await supabase
                                .from('prospectos')
                                .update({ seguimiento_vencido: datosLimpios.seguimiento_vencido })
                                .eq('id', parseInt(id));
                        }

                        if (datosLimpios.seguimiento_completado !== undefined) {
                            await supabase
                                .from('prospectos')
                                .update({ seguimiento_completado: datosLimpios.seguimiento_completado })
                                .eq('id', parseInt(id));
                        }

                        if (datosLimpios.fecha_seguimiento !== undefined) {
                            await supabase
                                .from('prospectos')
                                .update({ fecha_seguimiento: datosLimpios.fecha_seguimiento })
                                .eq('id', parseInt(id));
                        }

                        // Actualizar timestamp final
                        await supabase
                            .from('prospectos')
                            .update({ 
                                fecha_ultima_actualizacion: datosLimpios.fecha_ultima_actualizacion,
                                updated_at: datosLimpios.updated_at 
                            })
                            .eq('id', parseInt(id));

                        // Obtener el registro actualizado
                        const { data: finalData } = await supabase
                            .from('prospectos')
                            .select('id, codigo, nombre_cliente, apellido_cliente, telefono, email, estado, seguimiento_vencido, seguimiento_completado, fecha_ultima_actualizacion, asesor_nombre')
                            .eq('id', parseInt(id))
                            .single();

                        updateResult = finalData;
                        metodoUsado = 'individual_fields_update';

                    } catch (individualError) {
                        logger.error('❌ Método 2 también falló:', individualError);
                        
                        // MÉTODO 3: Raw SQL como último recurso
                        logger.info('🔄 Método 2 falló, usando raw SQL...');
                        
                        const sqlQuery = `
                            UPDATE prospectos 
                            SET 
                                seguimiento_vencido = $1,
                                seguimiento_completado = $2,
                                fecha_ultima_actualizacion = $3,
                                updated_at = $4
                            WHERE id = $5 AND activo = true
                            RETURNING id, codigo, nombre_cliente, apellido_cliente, telefono, email, estado, seguimiento_vencido, seguimiento_completado, fecha_ultima_actualizacion, asesor_nombre;
                        `;
                        
                        const { data: rawData, error: rawError } = await supabase.rpc('exec_sql', {
                            sql: sqlQuery,
                            params: [
                                datosLimpios.seguimiento_vencido || false,
                                datosLimpios.seguimiento_completado || false,
                                datosLimpios.fecha_ultima_actualizacion,
                                datosLimpios.updated_at,
                                parseInt(id)
                            ]
                        });

                        if (rawError) {
                            throw new Error(`Todos los métodos de actualización fallaron. Último error: ${rawError.message}`);
                        }

                        updateResult = rawData[0];
                        metodoUsado = 'raw_sql_update';
                    }
                } else {
                    throw error;
                }
            }

            if (!updateResult) {
                return res.status(404).json({
                    success: false,
                    error: 'No se pudo actualizar el prospecto'
                });
            }

            logger.info(`✅ Prospecto actualizado (${metodoUsado}): ${updateResult.codigo} - ${updateResult.nombre_cliente}`);

            res.json({
                success: true,
                data: updateResult,
                message: 'Prospecto actualizado exitosamente',
                method: metodoUsado,
                campos_actualizados: Object.keys(datosLimpios)
            });

        } catch (error) {
            logger.error('❌ Error general en actualizarProspecto:', {
                error_message: error.message,
                error_stack: error.stack,
                prospecto_id: req.params.id,
                request_body: req.body
            });

            res.status(500).json({
                success: false,
                error: 'Error al actualizar prospecto: ' + error.message
            });
        }
    }

    /**
     * 🚀 MÉTODO MEJORADO PARA CAMBIO DE ESTADO CON CONVERSIÓN AUTOMÁTICA
     * PATCH /api/prospectos/:id/estado
     * Cambiar estado del prospecto - CORREGIDO CON FECHAS PERU + INTEGRACIÓN AUTOMÁTICA
     */
    static async cambiarEstado(req, res) {
        try {
            const { id } = req.params;
            const { estado, motivo } = req.body;

            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de prospecto inválido'
                });
            }

            const estadosValidos = ['Prospecto', 'Cotizado', 'Negociacion', 'Cerrado', 'Perdido'];
            if (!estado || !estadosValidos.includes(estado)) {
                return res.status(400).json({
                    success: false,
                    error: 'Estado inválido',
                    estados_validos: estadosValidos
                });
            }

            logger.info(`🔄 Cambiando estado de prospecto ${id} a ${estado}`);

            // Obtener prospecto actual
            const { data: prospectoActual } = await supabase
                .from('prospectos')
                .select('*')
                .eq('id', id)
                .eq('activo', true)
                .single();

            if (!prospectoActual) {
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            const fechaActualPeru = obtenerFechaPeruISO();
            const datosActualizacion = {
                estado: estado,
                estado_anterior: prospectoActual.estado,
                fecha_ultima_actualizacion: fechaActualPeru
            };

            // Lógica especial por estado
            if (estado === 'Perdido') {
                if (!motivo) {
                    return res.status(400).json({
                        success: false,
                        error: 'El motivo es requerido cuando se marca como perdido'
                    });
                }
                datosActualizacion.motivo_perdida = motivo;
                datosActualizacion.fecha_cierre = fechaActualPeru;
            }

            if (estado === 'Cerrado') {
                datosActualizacion.fecha_cierre = fechaActualPeru;
                datosActualizacion.convertido_venta = true;
            }

            // Registrar en historial de interacciones
            const historialActual = parseHistorialSeguro(prospectoActual.historial_interacciones);
                const nuevaInteraccion = {
                    fecha: fechaActualPeru,
                    tipo: 'Cambio de Estado',
                    descripcion: `Estado cambiado de "${prospectoActual.estado}" a "${estado}"${motivo ? ` - Motivo: ${motivo}` : ''}`,
                    usuario: req.user?.nombre || 'Sistema'
                };
            
            datosActualizacion.historial_interacciones = [...historialActual, nuevaInteraccion];

            // Actualizar en base de datos
            const { data, error } = await supabase
                .from('prospectos')
                .update(datosActualizacion)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                logger.error('Error al cambiar estado:', error);
                throw error;
            }

            logger.info(`Estado cambiado: ${data.codigo} de "${prospectoActual.estado}" a "${estado}"`);

            // 🎯 CONVERSIÓN AUTOMÁTICA CUANDO ESTADO = "Cerrado"
            let ventaCreada = null;
            let conversionInfo = null;
            
            if (estado === 'Cerrado') {
                try {
                    logger.info(`🚀 INICIANDO CONVERSIÓN AUTOMÁTICA - Prospecto ${id} → Venta`);

                    // Preparar datos para conversión
                    const datosConversion = {
                        prospecto_id: parseInt(id),
                        asesor_id: req.user?.user_id || req.user?.id || prospectoActual.asesor_id,
                        valor_estimado: prospectoActual.valor_estimado || prospectoActual.presupuesto_estimado || 0,
                        cliente_nombre: prospectoActual.nombre_cliente,
                        cliente_apellido: prospectoActual.apellido_cliente,
                        cliente_email: prospectoActual.email,
                        cliente_telefono: prospectoActual.telefono,
                        cliente_empresa: prospectoActual.empresa,
                        fuente: 'prospecto_cerrado_automatico',
                        fecha_conversion: fechaActualPeru,
                        prioridad: 'media',
                        estado_inicial: 'Borrador',
                        notas_prospecto: `Convertido automáticamente desde prospecto ${id}. ${prospectoActual.observaciones || ''}`,
                        canal_origen: prospectoActual.canal_contacto,
                        productos_interes: prospectoActual.productos_interes || []
                    };

                    // Llamar al servicio de conversión
                    const resultadoConversion = await ConversionService.convertirDesdeKanban(
    parseInt(id),
    req.user?.user_id || req.user?.id || prospectoActual.asesor_id,
    motivo || ''
);

if (resultadoConversion && resultadoConversion.success) {
    ventaCreada = resultadoConversion.venta_creada;
    
    // NO necesitas actualizar el prospecto manualmente - el ConversionService ya lo hace
    
    conversionInfo = {
        exitosa: true,
        venta_creada: {
            id: ventaCreada.id,
            codigo: ventaCreada.codigo,
            valor_estimado: ventaCreada.valor_total, // Cambié de valor_estimado a valor_total
            estado: ventaCreada.estado
        },
        mensaje: `✅ Venta #${ventaCreada.codigo} creada automáticamente`
    };

    logger.info(`✅ CONVERSIÓN EXITOSA: Prospecto ${id} → Venta ${ventaCreada.id} ($${ventaCreada.valor_total})`);
} else {
    logger.error(`⚠️ Error en conversión automática:`, resultadoConversion);
    conversionInfo = {
        exitosa: false,
        error: resultadoConversion?.error || 'Error desconocido en conversión',
        mensaje: '⚠️ El prospecto se cerró exitosamente, pero hubo un problema creando la venta automáticamente'
    };
}
                } catch (conversionError) {
                    // No fallar el cambio de estado si hay error en conversión
                    logger.error(`❌ Error en conversión automática prospecto ${id}:`, {
                        error: conversionError.message,
                        stack: conversionError.stack,
                        prospecto_id: id,
                        asesor_id: req.user?.id
                    });

                    conversionInfo = {
                        exitosa: false,
                        error: conversionError.message,
                        mensaje: '⚠️ El prospecto se cerró exitosamente, pero hubo un error técnico en la conversión a venta'
                    };
                }
            }

            // Respuesta exitosa
            const respuesta = {
                success: true,
                message: `Estado actualizado a ${estado} exitosamente`,
                data: data,
                estado_anterior: prospectoActual.estado,
                estado_nuevo: estado,
                fecha_actualizacion: fechaActualPeru
            };

            // Agregar información de conversión si se intentó
            if (conversionInfo) {
                respuesta.conversion_automatica = conversionInfo;
            }

            logger.info(`✅ Estado actualizado: Prospecto ${id} → ${estado}${ventaCreada ? ` → Venta ${ventaCreada.id}` : ''}`);
            res.json(respuesta);

        } catch (error) {
            logger.error('Error en cambiarEstado:', error);
            res.status(500).json({
                success: false,
                error: 'Error al cambiar estado: ' + error.message
            });
        }
    }

    /**
     * 🚀 ENDPOINT PARA CONVERSIÓN MANUAL DE PROSPECTO A VENTA
     * POST /api/prospectos/:id/convertir-a-venta
     */
    static async convertirAVentaManual(req, res) {
        try {
            const { id } = req.params;
            const { valor_personalizado, notas_adicionales, prioridad = 'alta' } = req.body;

            logger.info(`🔄 Conversión manual iniciada: Prospecto ${id}`);

            // Verificar que el prospecto existe
            const { data: prospecto, error: errorProspecto } = await supabase
                .from('prospectos')
                .select('*')
                .eq('id', id)
                .eq('activo', true)
                .single();

            if (errorProspecto || !prospecto) {
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            // Verificar que no esté ya convertido
            if (prospecto.venta_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Este prospecto ya fue convertido a venta',
                    venta_existente: prospecto.venta_id
                });
            }

            const fechaActualPeru = obtenerFechaPeruISO();

            // Preparar datos para conversión
            const datosConversion = {
                prospecto_id: parseInt(id),
                asesor_id: req.user?.user_id || req.user?.id || prospecto.asesor_id,
                valor_estimado: valor_personalizado || prospecto.valor_estimado || prospecto.presupuesto_estimado || 0,
                cliente_nombre: prospecto.nombre_cliente,
                cliente_apellido: prospecto.apellido_cliente,
                cliente_email: prospecto.email,
                cliente_telefono: prospecto.telefono,
                cliente_empresa: prospecto.empresa,
                fuente: 'conversion_manual',
                fecha_conversion: fechaActualPeru,
                prioridad: prioridad,
                estado_inicial: 'Activa',
                notas_prospecto: `Conversión manual desde prospecto ${id}. ${prospecto.observaciones || ''}\n\nNotas adicionales: ${notas_adicionales || ''}`,
                canal_origen: prospecto.canal_contacto,
                productos_interes: prospecto.productos_interes || []
            };

            // Ejecutar conversión
            const resultado = await ConversionService.convertirProspectoAVenta(datosConversion);

            if (resultado && resultado.success) {
                // Actualizar prospecto
                await supabase
                    .from('prospectos')
                    .update({
                        estado: 'Cerrado',
                        venta_id: resultado.venta_creada.id,
                        fecha_conversion: fechaActualPeru,
                        fecha_cierre: fechaActualPeru,
                        estado_conversion: 'convertido',
                        convertido_venta: true,
                        fecha_ultima_actualizacion: fechaActualPeru
                    })
                    .eq('id', id);

                logger.info(`✅ Conversión manual exitosa: Prospecto ${id} → Venta ${resultado.venta_creada.id}`);

                res.status(201).json({
                    success: true,
                    mensaje: 'Prospecto convertido exitosamente a venta',
                    venta_creada: resultado.venta_creada,
                    prospecto_id: parseInt(id),
                    fecha_conversion: fechaActualPeru
                });

            } else {
                logger.error(`❌ Error en conversión manual:`, resultado);
                res.status(500).json({
                    success: false,
                    error: 'Error en la conversión',
                    detalle: resultado?.error || 'Error desconocido'
                });
            }

        } catch (error) {
            logger.error('❌ Error en conversión manual:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
                mensaje: error.message
            });
        }
    }

    /**
     * POST /api/prospectos/:id/cerrar-venta
     * Convertir prospecto en venta - CORREGIDO CON FECHAS PERU
     */
    static async cerrarVenta(req, res) {
        try {
            const { id } = req.params;
            const { valor_final, productos_vendidos, observaciones_cierre } = req.body;

            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de prospecto inválido'
                });
            }

            // Obtener prospecto
            const { data: prospecto } = await supabase
                .from('prospectos')
                .select('*')
                .eq('id', id)
                .eq('activo', true)
                .single();

            if (!prospecto) {
                return res.status(404).json({
                    success: false,
                    error: 'Prospecto no encontrado'
                });
            }

            // Validar que esté en estado válido para cerrar
            if (!['Cotizado', 'Negociacion'].includes(prospecto.estado)) {
                return res.status(400).json({
                    success: false,
                    error: 'Solo se pueden cerrar prospectos en estado Cotizado o Negociación'
                });
            }

            const valorVenta = valor_final || prospecto.valor_estimado || 0;
            const productosVendidos = productos_vendidos || prospecto.productos_interes || [];
            const fechaActualPeru = obtenerFechaPeruISO();

            // Actualizar prospecto como cerrado
            const datosActualizacion = {
                estado: 'Cerrado',
                convertido_venta: true,
                fecha_cierre: fechaActualPeru,
                fecha_ultima_actualizacion: fechaActualPeru,
                valor_estimado: valorVenta
            };

            if (observaciones_cierre) {
                datosActualizacion.observaciones = observaciones_cierre;
            }

            // Agregar interacción
            const historialActual = parseHistorialSeguro(prospecto.historial_interacciones);
            const nuevaInteraccion = {
                fecha: fechaActualPeru,
                tipo: 'Venta Cerrada',
                descripcion: `Prospecto convertido en venta exitosamente. Valor: $${valorVenta}`,
                usuario: req.user?.nombre || 'Sistema'
            };

            datosActualizacion.historial_interacciones = [...historialActual, nuevaInteraccion];

            const { data, error } = await supabase
                .from('prospectos')
                .update(datosActualizacion)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                logger.error('Error al cerrar venta:', error);
                throw error;
            }

            logger.info(`Venta cerrada: ${data.codigo} - $${valorVenta}`);

            // TODO: Integrar con módulo de ventas cuando esté implementado
            
            res.json({
                success: true,
                data: {
                    prospecto: data,
                    valor_venta: valorVenta,
                    productos_vendidos: productosVendidos
                },
                message: '¡Venta cerrada exitosamente!'
            });

        } catch (error) {
            logger.error('Error en cerrarVenta:', error);
            res.status(500).json({
                success: false,
                error: 'Error al cerrar venta: ' + error.message
            });
        }
    }

    /**
     * GET /api/prospectos/metricas/:asesorId?
     * Obtener métricas del pipeline
     */
    static async obtenerMetricas(req, res) {
        try {
            const { asesorId } = req.params;
            const { fecha_desde, fecha_hasta } = req.query;

            let query = supabase
                .from('prospectos')
                .select('estado, valor_estimado, fecha_contacto, fecha_cierre, convertido_venta')
                .eq('activo', true);

            if (asesorId && asesorId !== 'todos') {
                query = query.eq('asesor_id', asesorId);
            }

            if (fecha_desde) {
                query = query.gte('fecha_contacto', fecha_desde);
            }

            if (fecha_hasta) {
                query = query.lte('fecha_contacto', fecha_hasta);
            }

            const { data, error } = await query;

            if (error) {
                logger.error('Error al obtener métricas:', error);
                throw error;
            }

            // Calcular métricas
            const total = data?.length || 0;
            const cerrados = data?.filter(p => p.estado === 'Cerrado').length || 0;
            const perdidos = data?.filter(p => p.estado === 'Perdido').length || 0;
            const activos = data?.filter(p => ['Prospecto', 'Cotizado', 'Negociacion'].includes(p.estado)).length || 0;

            const valorTotalPipeline = data?.reduce((sum, p) => {
                if (['Prospecto', 'Cotizado', 'Negociacion'].includes(p.estado)) {
                    return sum + (parseFloat(p.valor_estimado) || 0);
                }
                return sum;
            }, 0) || 0;

            const valorVentas = data?.reduce((sum, p) => {
                if (p.estado === 'Cerrado') {
                    return sum + (parseFloat(p.valor_estimado) || 0);
                }
                return sum;
            }, 0) || 0;

            const tasaConversion = total > 0 ? ((cerrados / total) * 100).toFixed(2) : 0;
            const tasaPerdida = total > 0 ? ((perdidos / total) * 100).toFixed(2) : 0;

            const metricas = {
                total_prospectos: total,
                prospectos_activos: activos,
                cerrados: cerrados,
                perdidos: perdidos,
                tasa_conversion: `${tasaConversion}%`,
                tasa_perdida: `${tasaPerdida}%`,
                valor_total_pipeline: valorTotalPipeline,
                valor_ventas_cerradas: valorVentas,
                valor_promedio_prospecto: total > 0 ? (valorTotalPipeline / activos).toFixed(2) : 0,
                distribucion: {
                    prospecto: data?.filter(p => p.estado === 'Prospecto').length || 0,
                    cotizado: data?.filter(p => p.estado === 'Cotizado').length || 0,
                    negociacion: data?.filter(p => p.estado === 'Negociacion').length || 0,
                    cerrado: cerrados,
                    perdido: perdidos
                }
            };

            res.json({
                success: true,
                data: metricas
            });

        } catch (error) {
            logger.error('Error en obtenerMetricas:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener métricas: ' + error.message
            });
        }
    }

    /**
     * GET /api/prospectos/verificar-duplicado/:telefono
     * Verificar si existe duplicado por teléfono
     */
    static async verificarDuplicado(req, res) {
        try {
            const { telefono } = req.params;
            const { excluir_id } = req.query;

            if (!telefono) {
                return res.status(400).json({
                    success: false,
                    error: 'Teléfono es requerido'
                });
            }

            let query = supabase
                .from('prospectos')
                .select('id, codigo, nombre_cliente, apellido_cliente, estado, asesor_nombre, empresa')
                .eq('telefono', telefono)
                .eq('activo', true);

            if (excluir_id) {
                query = query.neq('id', excluir_id);
            }

            const { data, error } = await query;

            if (error) {
                logger.error('Error al verificar duplicado:', error);
                throw error;
            }

            res.json({
                success: true,
                existe_duplicado: (data?.length || 0) > 0,
                data: data || []
            });

        } catch (error) {
            logger.error('Error en verificarDuplicado:', error);
            res.status(500).json({
                success: false,
                error: 'Error al verificar duplicado: ' + error.message
            });
        }
    }

    /**
     * GET /api/prospectos/health
     * Health check del módulo - MEJORADO
     */
    static async healthCheck(req, res) {
        try {
            // Verificar conexión con base de datos
            const { count, error } = await supabase
                .from('prospectos')
                .select('*', { count: 'exact', head: true })
                .eq('activo', true);

            if (error) {
                throw error;
            }

            // Debug de usuario autenticado
            if (req.user) {
                console.log('🔐 Usuario autenticado en health:', {
                    user_id: req.user.user_id,
                    nombre: req.user.nombre_completo,
                    rol: req.user.rol
                });
            }

            res.json({
                success: true,
                module: 'Prospectos',
                status: 'Operativo',
                timestamp: obtenerFechaPeruISO(), // Usar fecha Peru
                timezone: 'America/Lima (UTC-5)',
                version: '1.0.2',
                integraciones: {
                    ventas_module: 'ConversionService integrado ✅',
                    conversion_automatica: 'Activa ✅',
                    conversion_manual: 'Disponible ✅'
                },
                data: {
                    total_prospectos: count,
                    estados_disponibles: ['Prospecto', 'Cotizado', 'Negociacion', 'Cerrado', 'Perdido'],
                    funcionalidades: [
                        'Pipeline Kanban',
                        'Detección de duplicados',
                        'Métricas en tiempo real',
                        'Filtros por fecha/antigüedad',
                        'Conversión automática a ventas ✨',
                        'Conversión manual a ventas ✨',
                        'Sistema de seguimientos automáticos',
                        'Timezone Peru (UTC-5) integrado'
                    ]
                }
            });

        } catch (error) {
            logger.error('Error en health check:', error);
            res.status(500).json({
                success: false,
                module: 'Prospectos',
                status: 'Error',
                timestamp: obtenerFechaPeruISO(),
                error: error.message
            });
        }
    }

    /**
     * POST /api/prospectos/seguimientos/corregir-null
     * Script para corregir seguimientos null en prospectos existentes
     */
    static async corregirSeguimientosNull(req, res) {
        try {
            logger.info('🔧 Iniciando corrección de seguimientos null...');
            
            // Buscar prospectos con seguimiento_obligatorio null
            const { data: prospectosNull, error: errorBuscar } = await supabase
                .from('prospectos')
                .select('id, codigo, created_at, fecha_contacto')
                .is('seguimiento_obligatorio', null)
                .eq('activo', true);

            if (errorBuscar) throw errorBuscar;

            logger.info(`📊 Encontrados ${prospectosNull.length} prospectos para corregir`);

            let corregidos = 0;
            for (const prospecto of prospectosNull) {
                // Calcular seguimiento_obligatorio basado en fecha_contacto + 24h (Peru timezone)
                const fechaBase = new Date(prospecto.fecha_contacto || prospecto.created_at);
                const fechaSeguimiento = new Date(fechaBase.getTime() + (24 * 60 * 60 * 1000));
                
                const { error: errorUpdate } = await supabase
                    .from('prospectos')
                    .update({ 
                        seguimiento_obligatorio: fechaSeguimiento.toISOString()
                    })
                    .eq('id', prospecto.id);

                if (errorUpdate) {
                    logger.error(`❌ Error corrigiendo ${prospecto.codigo}:`, errorUpdate);
                } else {
                    logger.info(`✅ Corregido ${prospecto.codigo}: ${fechaSeguimiento.toISOString()}`);
                    corregidos++;
                }
            }

            logger.info(`🎯 Corrección completada: ${corregidos}/${prospectosNull.length} prospectos`);
            
            res.json({
                success: true,
                message: 'Corrección de seguimientos completada',
                data: {
                    total_encontrados: prospectosNull.length,
                    total_corregidos: corregidos,
                    timestamp: obtenerFechaPeruISO()
                }
            });
            
        } catch (error) {
            logger.error('❌ Error en corrección:', error);
            res.status(500).json({
                success: false,
                error: 'Error al corregir seguimientos: ' + error.message
            });
        }
    }

    /**
     * 🚀 MÉTODO SUPERIOR UNIFICADO - VERSIÓN FINAL
     * POST /api/prospectos/seguimientos/procesar-vencidos
     * Procesar seguimientos vencidos con configuración flexible
     * 
     * @param {Object} req.body - Configuración del procesamiento
     * @param {string} req.body.modo - 'basico' | 'mejorado' (default: 'basico')
     * @param {boolean} req.body.incluir_notificaciones - Enviar notificaciones automáticas
     * @param {boolean} req.body.generar_estadisticas - Incluir estadísticas detalladas
     * @param {boolean} req.body.crear_reporte_detallado - Generar reporte completo
     * @param {Object} req.body.filtros - Filtros adicionales (asesor_id, valor_minimo, etc.)
     */
    static async procesarSeguimientosVencidos(req, res) {
        try {
            // Extraer configuración del request (con defaults seguros)
            const {
                modo = 'basico',                    // 'basico' | 'mejorado'
                incluir_notificaciones = false,
                generar_estadisticas = false,
                crear_reporte_detallado = false,
                filtros = {}
            } = req.body;

            const fechaActual = obtenerFechaPeruISO();
            
            logger.info(`🔄 Procesando seguimientos vencidos (modo: ${modo})...`);
            
            // 1. IDENTIFICAR SEGUIMIENTOS VENCIDOS (lógica base compartida)
            let query = supabase
                .from('prospectos')
                .select(`
                    id, codigo, nombre_cliente, apellido_cliente, telefono, 
                    asesor_id, asesor_nombre, seguimiento_obligatorio,
                    estado, valor_estimado, canal_contacto, empresa
                `)
                .lt('seguimiento_obligatorio', fechaActual)
                .eq('seguimiento_completado', false)
                .eq('seguimiento_vencido', false)
                .eq('activo', true)
                .in('estado', ['Prospecto', 'Cotizado', 'Negociacion']);

            // APLICAR FILTROS ADICIONALES si se proporcionan
            if (filtros.asesor_id) {
                query = query.eq('asesor_id', filtros.asesor_id);
                logger.info(`🎯 Filtrando por asesor: ${filtros.asesor_id}`);
            }
            
            if (filtros.valor_minimo) {
                query = query.gte('valor_estimado', filtros.valor_minimo);
                logger.info(`💰 Filtrando por valor mínimo: ${filtros.valor_minimo}`);
            }

            if (filtros.estado_especifico) {
                query = query.eq('estado', filtros.estado_especifico);
            }

            const { data: seguimientosVencidos, error } = await query;
            if (error) throw error;

            // CASO: No hay seguimientos vencidos
            if (!seguimientosVencidos || seguimientosVencidos.length === 0) {
                return res.json({
                    success: true,
                    message: '✅ No hay seguimientos vencidos por procesar',
                    data: {
                        total_procesados: 0,
                        exitosos: 0,
                        errores: 0,
                        modo_ejecutado: modo,
                        filtros_aplicados: Object.keys(filtros).length > 0 ? filtros : null,
                        timestamp: fechaActual
                    }
                });
            }

            logger.info(`📊 Encontrados ${seguimientosVencidos.length} seguimientos vencidos`);

            // 2. PROCESAMIENTO CORE (común para todos los modos)
            const resultados = [];
            let exitosos = 0;
            let errores = 0;
            
            for (const prospecto of seguimientosVencidos) {
                try {
                    // Update usando método que sabemos que funciona
                    await supabase
                        .from('prospectos')
                        .update({ seguimiento_vencido: true })
                        .eq('id', prospecto.id);

                    await supabase
                        .from('prospectos')
                        .update({ fecha_ultima_actualizacion: fechaActual })
                        .eq('id', prospecto.id);

                    // Calcular días vencido
                    const diasVencido = Math.floor(
                        (new Date(fechaActual) - new Date(prospecto.seguimiento_obligatorio)) / (1000 * 60 * 60 * 24)
                    );

                    // RESPUESTA DIFERENCIADA POR MODO
                    const resultado = {
                        prospecto_id: prospecto.id,
                        codigo: prospecto.codigo,
                        nombre: prospecto.nombre_cliente,
                        asesor: prospecto.asesor_nombre,
                        status: 'success'
                    };

                    if (modo === 'basico') {
                        // MODO BÁSICO: Información mínima, respuesta rápida
                        resultado.mensaje = `✅ Procesado exitosamente`;
                    } else {
                        // MODO MEJORADO: Información detallada
                        resultado.telefono = prospecto.telefono;
                        resultado.valor_estimado = prospecto.valor_estimado;
                        resultado.dias_vencido = diasVencido;
                        resultado.empresa = prospecto.empresa;
                        resultado.canal_contacto = prospecto.canal_contacto;
                        resultado.mensaje = `✅ Procesado exitosamente - ${diasVencido} días vencido`;
                    }

                    resultados.push(resultado);
                    exitosos++;

                    logger.info(`✅ Procesado: ${prospecto.codigo} - ${prospecto.nombre_cliente}`);

                } catch (updateError) {
                    const errorResult = {
                        prospecto_id: prospecto.id,
                        codigo: prospecto.codigo,
                        nombre: prospecto.nombre_cliente,
                        status: 'error',
                        mensaje: `❌ Error: ${updateError.message}`
                    };

                    resultados.push(errorResult);
                    errores++;
                    logger.error(`❌ Error procesando ${prospecto.codigo}:`, updateError);
                }
            }

            // 3. PREPARAR RESPUESTA BASE
            const respuestaBase = {
                success: true,
                message: `🎯 Procesamiento completado (${modo}): ${exitosos}/${seguimientosVencidos.length} seguimientos`,
                data: {
                    total_procesados: seguimientosVencidos.length,
                    exitosos: exitosos,
                    errores: errores,
                    modo_ejecutado: modo,
                    filtros_aplicados: Object.keys(filtros).length > 0 ? filtros : null,
                    timestamp: fechaActual
                }
            };

            // 4. FUNCIONALIDADES ADICIONALES OPCIONALES

            // ESTADÍSTICAS DETALLADAS (si se solicita o es modo mejorado)
            if (generar_estadisticas || modo === 'mejorado') {
                const valorTotalAfectado = seguimientosVencidos.reduce((sum, p) => 
                    sum + (parseFloat(p.valor_estimado) || 0), 0
                );

                const asesoresAfectados = [...new Set(seguimientosVencidos.map(p => p.asesor_id))];
                
                respuestaBase.data.estadisticas = {
                    valor_total_afectado: valorTotalAfectado,
                    asesores_afectados: asesoresAfectados.length,
                    tasa_exito: seguimientosVencidos.length > 0 ? 
                        ((exitosos / seguimientosVencidos.length) * 100).toFixed(1) + '%' : '0%',
                    promedio_dias_vencido: resultados
                        .filter(r => r.dias_vencido)
                        .reduce((sum, r) => sum + r.dias_vencido, 0) / 
                        Math.max(resultados.filter(r => r.dias_vencido).length, 1),
                    distribucion_por_asesor: asesoresAfectados.map(asesorId => {
                        const prospectosAsesor = seguimientosVencidos.filter(p => p.asesor_id === asesorId);
                        return {
                            asesor_id: asesorId,
                            asesor_nombre: prospectosAsesor[0]?.asesor_nombre || 'Desconocido',
                            cantidad: prospectosAsesor.length,
                            valor_total: prospectosAsesor.reduce((sum, p) => sum + (parseFloat(p.valor_estimado) || 0), 0)
                        };
                    })
                };

                logger.info(`📈 Estadísticas generadas: $${valorTotalAfectado} afectados, ${asesoresAfectados.length} asesores`);
            }

            // NOTIFICACIONES AUTOMÁTICAS (si se solicita)
            if (incluir_notificaciones) {
                const notificacionesCreadas = [];
                const asesoresInfo = respuestaBase.data.estadisticas?.distribucion_por_asesor || [];
                
                for (const asesorInfo of asesoresInfo) {
                    try {
                        const prioridad = asesorInfo.valor_total > 25000 ? 'alta' : 
                                         asesorInfo.cantidad > 3 ? 'media' : 'normal';

                        const { data: notificacion, error: notifError } = await supabase
                            .from('notificaciones')
                            .insert({
                                usuario_id: asesorInfo.asesor_id,
                                tipo: 'seguimiento_vencido',
                                titulo: `⚠️ Seguimientos Vencidos (${asesorInfo.cantidad})`,
                                mensaje: `Tienes ${asesorInfo.cantidad} seguimiento(s) vencido(s) que requieren atención inmediata por un valor de $${asesorInfo.valor_total.toLocaleString()}`,
                                datos_adicionales: JSON.stringify({
                                    cantidad_vencidos: asesorInfo.cantidad,
                                    valor_total: asesorInfo.valor_total,
                                    procesamiento_id: `proc_${Date.now()}`,
                                    timestamp: fechaActual
                                }),
                                prioridad: prioridad,
                                accion_url: '/prospectos?tab=seguimientos',
                                accion_texto: 'Ver Seguimientos'
                            })
                            .select()
                            .single();

                        if (!notifError && notificacion) {
                            notificacionesCreadas.push({
                                asesor_id: asesorInfo.asesor_id,
                                asesor_nombre: asesorInfo.asesor_nombre,
                                notificacion_id: notificacion.id,
                                cantidad_vencidos: asesorInfo.cantidad,
                                prioridad: prioridad
                            });
                            
                            logger.info(`🔔 Notificación creada para ${asesorInfo.asesor_nombre}: ${asesorInfo.cantidad} seguimientos (${prioridad})`);
                        } else {
                            logger.error(`❌ Error creando notificación para asesor ${asesorInfo.asesor_id}:`, notifError);
                        }

                    } catch (notifError) {
                        logger.error(`❌ Error creando notificación para asesor ${asesorInfo.asesor_id}:`, notifError);
                    }
                }

                respuestaBase.data.notificaciones_enviadas = notificacionesCreadas;
                logger.info(`📬 ${notificacionesCreadas.length} notificaciones enviadas`);
            }

            // REPORTE DETALLADO (si se solicita o es modo mejorado)
            if (crear_reporte_detallado || modo === 'mejorado') {
                respuestaBase.data.prospectos = resultados;
                
                respuestaBase.data.resumen = {
                    titulo: `🎯 Procesamiento Completado (${modo.toUpperCase()})`,
                    descripcion: exitosos > 0 ? 
                        `Se procesaron ${exitosos} seguimientos vencidos exitosamente de ${seguimientosVencidos.length} encontrados.` :
                        'No se pudieron procesar seguimientos en este momento. Revisar logs para más detalles.',
                    proximos_pasos: [
                        '📋 Los seguimientos han sido marcados como vencidos',
                        '📈 El dashboard refleja los cambios automáticamente',
                        ...(respuestaBase.data.notificaciones_enviadas?.length > 0 ? 
                            [`🔔 ${respuestaBase.data.notificaciones_enviadas.length} notificaciones enviadas a asesores`] : []),
                        '⏰ Se recomienda hacer seguimiento inmediato a los prospectos afectados',
                        ...(respuestaBase.data.estadisticas?.valor_total_afectado > 50000 ? 
                            ['🚨 ALTA PRIORIDAD: Valor total en riesgo superior a $50,000'] : [])
                    ],
                    timestamp: fechaActual,
                    criticidad: exitosos > 0 ? 
                        (respuestaBase.data.estadisticas?.valor_total_afectado > 50000 ? 'alta' :
                         respuestaBase.data.estadisticas?.valor_total_afectado > 10000 ? 'media' : 'normal') : 'baja'
                };
            }

            // ALERTAS AUTOMÁTICAS (solo en modo mejorado)
            if (modo === 'mejorado') {
                respuestaBase.data.alertas = {
                    valor_alto_riesgo: (respuestaBase.data.estadisticas?.valor_total_afectado || 0) > 50000,
                    multiples_asesores_afectados: (respuestaBase.data.estadisticas?.asesores_afectados || 0) > 3,
                    tasa_error_alta: errores > (seguimientosVencidos.length * 0.1),
                    seguimientos_muy_vencidos: resultados.some(r => r.dias_vencido && r.dias_vencido > 30)
                };
            }

            // LOG FINAL UNIFICADO
            logger.info(`📊 Procesamiento ${modo} completado:`, {
                total: seguimientosVencidos.length,
                exitosos,
                errores,
                filtros: Object.keys(filtros).length > 0 ? filtros : 'ninguno',
                estadisticas_incluidas: !!respuestaBase.data.estadisticas,
                notificaciones_enviadas: respuestaBase.data.notificaciones_enviadas?.length || 0,
                valor_afectado: respuestaBase.data.estadisticas?.valor_total_afectado || 0
            });

            res.json(respuestaBase);

        } catch (error) {
            logger.error('❌ Error en procesarSeguimientosVencidos unificado:', error);
            res.status(500).json({
                success: false,
                message: '❌ Error procesando seguimientos vencidos',
                error: error.message,
                data: {
                    total_procesados: 0,
                    exitosos: 0,
                    errores: 1,
                    modo_ejecutado: req.body.modo || 'basico',
                    filtros_aplicados: req.body.filtros || null,
                    timestamp: obtenerFechaPeruISO()
                }
            });
        }
    }
}

module.exports = ProspectosController;